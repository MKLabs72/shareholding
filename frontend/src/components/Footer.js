import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { FaInstagram, FaTelegramPlane, FaYoutube } from 'react-icons/fa';
import { SiMedium } from "react-icons/si";
import { SiCoinmarketcap } from "react-icons/si";
import { BiRocket, BiCard } from 'react-icons/bi';
import { MdOutlineIntegrationInstructions } from "react-icons/md";
import { LuArrowLeftRight } from "react-icons/lu";
import { useNavigate } from 'react-router-dom';
import SETTINGS from '../SETTINGS';

const TwitterIcon = () => (
  <svg className="twitter" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="19" height="19">
    <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" />
  </svg>
);

const Footer = () => {
  const navigate = useNavigate();

  const openLink = (_link) => {
    navigate(_link);
  }

  const hardRefreshWebsite = () => {
    window.location.reload(true);
  };


  return (
<footer className="footer">
  <Container>
    <Row className="footer-content align-items-center">
      {/* Social Icons */}
            <Col xs={12} md={1} className="text-center mb-md-0 footer-social">
        <button className='versionBtn' onClick={hardRefreshWebsite}>V: {SETTINGS.version}</button>
      </Col>
      <Col xs={12} md={3} className="text-center mb-md-0 footer-social">
        <a href="https://t.me/waveswaps" target="_blank" rel="noopener noreferrer" className="social-icon telegram">
          <FaTelegramPlane size={21} />
        </a>
        <a href="https://x.com/waveswaps/" target="_blank" rel="noopener noreferrer" className="social-icon twitter">
          <TwitterIcon />
        </a>
        <a href="https://www.youtube.com/@WaveSwaps" target="_blank" rel="noopener noreferrer" className="social-icon youtube">
          <FaYoutube size={21} />
        </a>
        <a href="https://medium.com/@waveswaps" target="_blank" rel="noopener noreferrer" className="social-icon medium">
          <SiMedium size={21} />
        </a>
        <a href="https://coinmarketcap.com" target="_blank" rel="noopener noreferrer" className="social-icon coinmarketcap">
          <SiCoinmarketcap size={21} />
        </a>
      </Col>
      {/* Copyright */}
      <Col xs={12} md={4} className="text-center">
        <p className="footer-copy">&copy; 2025 WaveSwaps. All rights reserved.</p>
      </Col>

      {/* Footer Links */}
      <Col xs={12} md={4} className="text-center mb-md-0 footer-links">
        <a href="https://docs.waveswaps.com/ws-official/privacy-policy" className="footer-link">Privacy</a>
        <a href="https://docs.waveswaps.com/ws-official/terms-and-conditions" className="footer-link">Terms</a>
        <a href="https://docs.waveswaps.com/ws-official/fee-schedule" className="footer-link">Fees</a>
        <a href="https://docs.waveswaps.com/" className="footer-link">Docs</a>
        <a onClick={() => openLink('/site-map')} className="footer-link">SiteMap</a>
      </Col>
    </Row>
  </Container>
</footer>


  );
};

export default Footer;
